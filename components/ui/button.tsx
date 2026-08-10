import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-strong)] border border-transparent",
  secondary:
    "bg-white text-[var(--color-ink)] border border-[var(--color-border)] hover:border-[var(--color-accent)]",
  ghost: "bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-surface)] border border-transparent",
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90 border border-transparent",
  success: "bg-[var(--color-success)] text-white hover:opacity-90 border border-transparent",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-caption",
  md: "min-h-11 px-4 text-body",
  lg: "min-h-12 px-6 text-subtitle",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
