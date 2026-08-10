"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectToSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/auth/sign-in?${qs}` : "/auth/sign-in");
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted)]">
      Taking you to sign in…
    </main>
  );
}

/** Join and sign-in are the same Google flow; club details happen in onboarding. */
export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted)]">
          Loading…
        </main>
      }
    >
      <RedirectToSignIn />
    </Suspense>
  );
}
