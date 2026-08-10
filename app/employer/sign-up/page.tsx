"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import {
  SignInProgress,
  type SignInStage,
} from "@/components/auth/sign-in-progress";
import { ensureEmployerRoleClient } from "@/lib/dal/roles";

export default function EmployerSignUpPage() {
  const { signInGoogle, setRoles } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<SignInStage | null>(null);

  async function onGoogle() {
    setStage("google");
    setError(null);
    try {
      await signInGoogle({
        onProgress: (s) => setStage(s),
      });
      setStage("workspace");
      const roles = await ensureEmployerRoleClient();
      setRoles(roles);
      setStage("redirect");
      router.push("/employer/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setStage(null);
    }
  }

  return (
    <main className="hero-atmosphere flex min-h-screen items-center justify-center px-4 py-12">
      {stage && <SignInProgress stage={stage} portalLabel="Employer portal" />}
      <div className={`w-full max-w-md ${stage ? "pointer-events-none opacity-40" : ""}`}>
        <Logo />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Employer portal
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Register your business</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Continue with Google, then create your company profile and submit Rotary affiliation for
          review. Invited managers must use the same Google email they were invited with.
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
          Already registered?{" "}
          <Link href="/employer/sign-in" className="font-semibold text-[var(--color-accent-strong)]">
            Employer sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
