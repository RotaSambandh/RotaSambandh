"use client";

import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

/** Styled native select — closed trigger is branded; open list uses OS popup. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "w-full appearance-none rounded-lg border border-[var(--color-border)]",
          "bg-white px-3 py-2.5 pr-10 text-sm text-[var(--color-ink)]",
          "shadow-sm transition",
          "hover:border-[var(--color-accent)]/50",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--color-muted)]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
