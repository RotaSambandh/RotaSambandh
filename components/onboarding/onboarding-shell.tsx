"use client";

import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Stepper } from "@/components/ui";
import { Button } from "@/components/ui/button";

export function OnboardingShell({
  title,
  description,
  steps,
  current,
  children,
  onBack,
  onContinue,
  continueLabel = "Continue",
  continueDisabled,
  backHidden,
}: {
  title: string;
  description?: string;
  steps: Array<{ id: string; label: string }>;
  current: string;
  children: ReactNode;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  backHidden?: boolean;
}) {
  return (
    <main className="hero-atmosphere flex min-h-screen justify-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-xl">
        <Logo />
        <div className="mt-8">
          <Stepper steps={steps} current={current} />
        </div>
        <h1 className="mt-8 font-display text-3xl font-semibold text-[var(--color-ink)]">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{description}</p>
        ) : null}
        <div className="mt-6 space-y-4">{children}</div>
        {(onBack || onContinue) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {onBack && !backHidden ? (
              <Button type="button" variant="secondary" onClick={onBack}>
                Back
              </Button>
            ) : null}
            {onContinue ? (
              <Button type="button" disabled={continueDisabled} onClick={onContinue}>
                {continueLabel}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
