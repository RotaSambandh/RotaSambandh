"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import {
  SignInProgress,
  type SignInStage,
} from "@/components/auth/sign-in-progress";
import { isPlatformStaff } from "@/shared/rbac";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function AdminSignInForm() {
  const { signInGoogle, roles, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<SignInStage | null>(null);
  const staff = isPlatformStaff(roles);

  useEffect(() => {
    if (authLoading || !user) return;
    if (staff) {
      setStage("redirect");
      router.replace(next?.startsWith("/admin") ? next : "/admin");
    } else if (stage && !staff) {
      // Signed in but not staff — drop the overlay so the message is visible.
      setStage(null);
    }
  }, [authLoading, user, staff, router, next, stage]);

  async function onGoogle() {
    setStage("google");
    setError(null);
    try {
      await signInGoogle({
        onProgress: (s) => setStage(s),
      });
      setStage("workspace");
      // Redirect handled by effect once roles are in place.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setStage(null);
    }
  }

  return (
    <main className="hero-atmosphere flex min-h-screen items-center justify-center px-4 py-12">
      {stage && <SignInProgress stage={stage} portalLabel="Admin portal" />}
      <div className={`w-full max-w-md ${stage ? "pointer-events-none opacity-40" : ""}`}>
        <Logo />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Admin portal
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Invite-only. Use the Google account that was seeded or invited as platform staff. There is
          no public admin signup.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        {user && !staff && !authLoading && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            Signed in as {user.email}, but this account is not on the platform staff list. Ask a
            super admin for access, or run the seed script for your Google email.
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
          <Link href="/auth/sign-in" className="font-semibold text-[var(--color-accent-strong)]">
            Candidate sign in
          </Link>
          {" · "}
          <Link href="/employer/sign-in" className="font-semibold text-[var(--color-accent-strong)]">
            Employer sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function AdminSignInPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted)]">
          Loading…
        </main>
      }
    >
      <AdminSignInForm />
    </Suspense>
  );
}
