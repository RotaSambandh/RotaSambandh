"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getCandidateProfile,
  getUser,
  isCandidateOnboardingComplete,
  updateCandidateProfile,
  updateUserPhone,
} from "@/lib/dal/users";
import { LoadingBlock } from "@/components/ui";
import { ClubDistrictPicker } from "@/components/clubs/club-district-picker";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "rotaract", label: "Rotaract" },
  { id: "professional", label: "Profile" },
  { id: "contact", label: "Contact" },
  { id: "done", label: "Done" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function CandidateOnboardingForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/jobs";

  const [step, setStep] = useState<StepId>("welcome");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [skills, setSkills] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [clubReady, setClubReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/auth/sign-in?next=${encodeURIComponent("/candidate/onboarding")}`);
      return;
    }
    void (async () => {
      const [profile, userDoc] = await Promise.all([
        getCandidateProfile(user.uid),
        getUser(user.uid),
      ]);
      if (isCandidateOnboardingComplete(profile, userDoc)) {
        router.replace(next);
        return;
      }
      if (profile) {
        setHeadline(profile.headline ?? "");
        setAbout(profile.about ?? "");
        setSkills((profile.skills ?? []).join(", "));
        setLinkedInUrl(profile.linkedInUrl ?? "");
        setPortfolioUrl(profile.portfolioUrl ?? "");
      }
      if (userDoc?.phone) setPhone(userDoc.phone);
    })();
  }, [user, loading, router, next]);

  const stepIndex = useMemo(() => STEPS.findIndex((s) => s.id === step), [step]);

  function goBack() {
    if (stepIndex <= 0) return;
    setStep(STEPS[stepIndex - 1]!.id);
    setError(null);
  }

  async function goContinue() {
    if (!user) return;
    setError(null);
    setBusy(true);
    try {
      if (step === "welcome") {
        setStep("rotaract");
        return;
      }
      if (step === "rotaract") {
        // ClubDistrictPicker writes hidden inputs; read from DOM form fields via state set by submit.
        const club = (document.querySelector('input[name="club"]') as HTMLInputElement | null)?.value?.trim();
        const district = (document.querySelector('input[name="district"]') as HTMLInputElement | null)
          ?.value?.trim();
        if (!club || !district) {
          setError("Select your district and Rotaract club to continue.");
          return;
        }
        await updateCandidateProfile(user.uid, { rotaractClub: club, rotaractDistrict: district });
        setClubReady(true);
        setStep("professional");
        return;
      }
      if (step === "professional") {
        const skillList = skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!headline.trim() || !about.trim() || skillList.length === 0) {
          setError("Headline, about, and at least one skill are required.");
          return;
        }
        await updateCandidateProfile(user.uid, {
          headline: headline.trim(),
          about: about.trim(),
          skills: skillList,
        });
        setStep("contact");
        return;
      }
      if (step === "contact") {
        if (!phone.trim()) {
          setError("Phone is required so employers can contact you on applications.");
          return;
        }
        await updateUserPhone(user.uid, phone.trim());
        await updateCandidateProfile(user.uid, {
          linkedInUrl: linkedInUrl.trim() || undefined,
          portfolioUrl: portfolioUrl.trim() || undefined,
        });
        setStep("done");
        return;
      }
      if (step === "done") {
        router.push(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
        step === "welcome"
          ? "Welcome to RotaSambandh"
          : step === "rotaract"
            ? "Your Rotaract club"
            : step === "professional"
              ? "Professional basics"
              : step === "contact"
                ? "Contact and links"
                : "You're all set"
      }
      description={
        step === "welcome"
          ? `Signed in as ${user.displayName || user.email}. Add your club and phone to apply. You can browse jobs anytime.`
          : step === "rotaract"
            ? "We use your club and district to keep this network trusted for Rotaractors."
            : step === "professional"
              ? "Employers see this when you apply."
              : step === "contact"
                ? "Phone is saved on each application for that employer. LinkedIn and portfolio links are optional (recommended, not required)."
                : "You can refine details anytime from Profile. Resume upload happens when you apply to a role."
      }
      steps={[...STEPS]}
      current={step}
      onBack={step === "welcome" || step === "done" ? undefined : goBack}
      onContinue={() => void goContinue()}
      continueLabel={step === "done" ? "Browse jobs" : busy ? "Saving…" : "Continue"}
      continueDisabled={busy}
    >
      {error ? (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      {step === "welcome" ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
          <p>
            <span className="text-[var(--color-muted)]">Name</span>
            <br />
            <span className="font-medium">{user.displayName}</span>
          </p>
          <p className="mt-3">
            <span className="text-[var(--color-muted)]">Email</span>
            <br />
            <span className="font-medium">{user.email}</span>
          </p>
        </div>
      ) : null}

      {step === "rotaract" ? <ClubDistrictPicker /> : null}

      {step === "professional" ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Product designer · Rotaractor"
              required
            />
          </div>
          <div>
            <Label htmlFor="about">About</Label>
            <Textarea
              id="about"
              rows={4}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="A short introduction for employers"
              required
            />
          </div>
          <div>
            <Label htmlFor="skills">Skills (comma-separated)</Label>
            <Input
              id="skills"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="React, Communication, Excel"
              required
            />
          </div>
        </div>
      ) : null}

      {step === "contact" ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 …"
              required
            />
          </div>
          <div>
            <Label htmlFor="linkedin">LinkedIn URL (recommended)</Label>
            <Input
              id="linkedin"
              type="url"
              value={linkedInUrl}
              onChange={(e) => setLinkedInUrl(e.target.value)}
              placeholder="https://linkedin.com/in/…"
            />
          </div>
          <div>
            <Label htmlFor="portfolio">Portfolio URL (optional)</Label>
            <Input
              id="portfolio"
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://…"
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Share work samples via a link. Do not upload large portfolios as your resume.
            </p>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <p className="text-sm text-[var(--color-muted)]">
          {clubReady
            ? "Your Rotaract profile is ready. Next stop: opportunities from verified businesses."
            : "Your profile is ready."}
        </p>
      ) : null}
    </OnboardingShell>
  );
}

export default function CandidateOnboardingPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading…" />}>
      <CandidateOnboardingForm />
    </Suspense>
  );
}
