import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "neutral" | "danger";

const variants: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning-ink)]",
  neutral: "bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)]",
  danger: "bg-red-50 text-[var(--color-danger)]",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-caption font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
