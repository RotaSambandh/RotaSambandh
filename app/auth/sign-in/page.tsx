"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import {
  SignInProgress,
  type SignInStage,
} from "@/components/auth/sign-in-progress";
import { getClientAuth } from "@/lib/firebase/client";
import { getCandidateProfile, getUser, isCandidateOnboardingComplete } from "@/lib/dal/users";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function CandidateSignInForm() {
  const { signInGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<SignInStage | null>(null);

  async function goAfterSignIn(uid: string) {
    if (next?.startsWith("/employer")) {
      setStage("redirect");
      router.push(`/employer/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }
    if (next?.startsWith("/admin")) {
      setStage("redirect");
      router.push(`/admin/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }

    setStage("workspace");
    const [profile, userDoc] = await Promise.all([getCandidateProfile(uid), getUser(uid)]);
    setStage("redirect");
    if (!isCandidateOnboardingComplete(profile, userDoc)) {
      const dest = next ?? "/candidate";
      router.push(`/candidate/onboarding?next=${encodeURIComponent(dest)}`);
      return;
    }
    router.push(next ?? "/candidate");
  }

  async function onGoogle() {
    setStage("google");
    setError(null);
    try {
      await signInGoogle({
        onProgress: (s) => setStage(s),
      });
      const uid = getClientAuth().currentUser?.uid;
      if (!uid) throw new Error("Signed in, but session is not ready. Try again.");
      await goAfterSignIn(uid);
      // Keep overlay until navigation unmounts this page.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setStage(null);
    }
  }

  return (
    <main className="hero-atmosphere flex min-h-screen items-center justify-center px-4 py-12">
      {stage && <SignInProgress stage={stage} portalLabel="Rotaract members" />}
      <div className={`w-full max-w-md ${stage ? "pointer-events-none opacity-40" : ""}`}>
        <Logo />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Rotaract members
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Continue with Google</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          One Google sign-in for new and returning Rotaractors. If you are new, we will ask for your
          club and district next so your profile is complete.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <Button
          type="button"
          className="mt-6 w-full"
          disabled={Boolean(stage)}
          onClick={() => void onGoogle()}
        >
          Continue with Google
        </Button>
        <p className="mt-6 text-sm text-[var(--color-muted)]">
          Hiring?{" "}
          <Link href="/employer/sign-in" className="font-semibold text-[var(--color-accent-strong)]">
            Employer portal
          </Link>
          {" · "}
          <Link href="/admin/sign-in" className="font-semibold text-[var(--color-accent-strong)]">
            Admin
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted)]">
          Loading…
        </main>
      }
    >
      <CandidateSignInForm />
    </Suspense>
  );
}
