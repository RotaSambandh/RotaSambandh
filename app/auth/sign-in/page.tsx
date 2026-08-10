"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
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
  const [loading, setLoading] = useState(false);

  async function goAfterSignIn(uid: string) {
    if (next?.startsWith("/employer")) {
      router.push(`/employer/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }
    if (next?.startsWith("/admin")) {
      router.push(`/admin/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }

    const [profile, userDoc] = await Promise.all([getCandidateProfile(uid), getUser(uid)]);
    if (!isCandidateOnboardingComplete(profile, userDoc)) {
      const dest = next ?? "/candidate";
      router.push(`/candidate/onboarding?next=${encodeURIComponent(dest)}`);
      return;
    }
    router.push(next ?? "/candidate");
  }

  async function onGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInGoogle();
      const uid = getClientAuth().currentUser?.uid;
      if (!uid) throw new Error("Signed in, but session is not ready. Try again.");
      await goAfterSignIn(uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="hero-atmosphere flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
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
        <Button type="button" className="mt-6 w-full" disabled={loading} onClick={() => void onGoogle()}>
          {loading ? "Waiting for Google…" : "Continue with Google"}
        </Button>
        <p className="mt-6 text-sm text-[var(--color-muted)]">
          Hiring?{" "}
          <Link href="/employer/sign-in" className="font-semibold text-[var(--color-accent-strong)]">
            Employer portal
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
