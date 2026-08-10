"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { ensureEmployerRoleClient } from "@/lib/dal/roles";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function EmployerSignInForm() {
  const { signInGoogle, setRoles } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInGoogle();
      const roles = await ensureEmployerRoleClient();
      setRoles(roles);
      router.push(next && next.startsWith("/employer") ? next : "/employer");
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
          Employer portal
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Hire Rotaractors through verified Rotary-linked businesses. Use the Google account that
          matches your company or invite email.
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
          New employer?{" "}
          <Link href="/employer/sign-up" className="font-semibold text-[var(--color-accent-strong)]">
            Register your business
          </Link>
        </p>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Looking for jobs?{" "}
          <Link href="/auth/sign-in" className="font-semibold text-[var(--color-accent-strong)]">
            Candidate sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function EmployerSignInPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted)]">
          Loading…
        </main>
      }
    >
      <EmployerSignInForm />
    </Suspense>
  );
}
