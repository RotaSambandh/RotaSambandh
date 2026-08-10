"use client";

import { Logo } from "@/components/brand/logo";

export type SignInStage = "google" | "session" | "workspace" | "redirect";

const COPY: Record<
  SignInStage,
  { title: string; detail: string }
> = {
  google: {
    title: "Waiting for Google",
    detail: "Finish choosing your account. We’ll bring you right back here.",
  },
  session: {
    title: "Signing you in",
    detail: "Confirming your account and creating a secure session…",
  },
  workspace: {
    title: "Preparing your workspace",
    detail: "Loading your profile and permissions…",
  },
  redirect: {
    title: "Almost there",
    detail: "Taking you to your dashboard…",
  },
};

const STAGE_ORDER: SignInStage[] = ["google", "session", "workspace", "redirect"];

export function SignInProgress({
  stage,
  portalLabel,
}: {
  stage: SignInStage;
  /** e.g. "Rotaract members", "Employer portal" */
  portalLabel?: string;
}) {
  const copy = COPY[stage];
  const activeIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-navy-deep)]/92 px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm text-center text-white">
        <div className="flex justify-center">
          <Logo tone="light" />
        </div>
        {portalLabel && (
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            {portalLabel}
          </p>
        )}
        <div
          className="mx-auto mt-8 h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-[var(--color-accent-soft)]"
          aria-hidden
        />
        <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{copy.detail}</p>
        <ol className="mt-8 flex justify-center gap-2" aria-hidden>
          {STAGE_ORDER.map((s, i) => (
            <li
              key={s}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= activeIndex ? "bg-[var(--color-accent-soft)]" : "bg-white/20"
              }`}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Compact full-page gate used by RequireAuth while session is resolving. */
export function SessionCheckingScreen() {
  return (
    <main className="hero-atmosphere flex min-h-screen flex-col items-center justify-center px-4">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]"
        aria-hidden
      />
      <p className="mt-5 text-sm font-medium text-[var(--color-ink)]">Checking your session…</p>
      <p className="mt-1 max-w-xs text-center text-sm text-[var(--color-muted)]">
        This only takes a moment.
      </p>
    </main>
  );
}
